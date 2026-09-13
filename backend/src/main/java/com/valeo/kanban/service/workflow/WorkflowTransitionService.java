package com.valeo.kanban.service.workflow;

import com.valeo.kanban.dto.request.WorkflowTransitionUpdateRequest;
import com.valeo.kanban.exception.custom.InvalidStateTransitionException;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.model.entity.WorkflowTransition;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.WorkflowTransitionRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowTransitionService {

    private final WorkflowTransitionRepository transitionRepository;
    private final BoardRepository boardRepository;
    private final ColumnRepository columnRepository;

    @Transactional(readOnly = true)
    public List<WorkflowTransitionUpdateRequest> getTransitions(Long boardId) {
        return transitionRepository.findAllByBoardId(boardId).stream()
                .map(WorkflowTransitionService::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<WorkflowTransitionUpdateRequest> updateTransitions(Long boardId, List<WorkflowTransitionUpdateRequest> requests) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));

        List<Column> columns = columnRepository.findAllByBoardIdOrderByPositionAsc(boardId);
        Map<Long, Column> columnsById = columns.stream()
                .collect(Collectors.toMap(Column::getId, Function.identity()));

        // Validate all transition references & check for self-transitions (Phase 5 / Issue 15)
        for (WorkflowTransitionUpdateRequest req : requests) {
            if (!columnsById.containsKey(req.getFromColumnId())) {
                throw new InvalidStateTransitionException(
                        "fromColumnId " + req.getFromColumnId() + " does not belong to board " + boardId);
            }
            if (!columnsById.containsKey(req.getToColumnId())) {
                throw new InvalidStateTransitionException(
                        "toColumnId " + req.getToColumnId() + " does not belong to board " + boardId);
            }
            if (req.getFallbackColumnId() != null && !columnsById.containsKey(req.getFallbackColumnId())) {
                throw new InvalidStateTransitionException(
                        "fallbackColumnId " + req.getFallbackColumnId() + " does not belong to board " + boardId);
            }
            if (req.getFromColumnId().equals(req.getToColumnId())) {
                throw new InvalidStateTransitionException(
                        "A column cannot transition to itself: columnId=" + req.getFromColumnId());
            }
            // A rejected card has to go somewhere, so every gate names a column other than its own target
            if (req.isRequiresApproval()) {
                String rule = columnsById.get(req.getFromColumnId()).getName()
                        + " -> " + columnsById.get(req.getToColumnId()).getName();
                if (req.getFallbackColumnId() == null) {
                    throw new InvalidStateTransitionException(
                            "The rule " + rule + " requires approval, so it needs a fallback column for rejected cards.");
                }
                if (req.getFallbackColumnId().equals(req.getToColumnId())) {
                    throw new InvalidStateTransitionException(
                            "The rule " + rule + " cannot fall back to its own target column.");
                }
            }
        }

        // Delete existing transitions for this board
        List<WorkflowTransition> existing = transitionRepository.findAllByBoardId(boardId);
        transitionRepository.deleteAll(existing);
        transitionRepository.flush();

        // Map and save new transitions. A fallback only means something on a rule that requires approval.
        List<WorkflowTransition> newTransitions = requests.stream()
                .map(req -> WorkflowTransition.builder()
                        .board(board)
                        .fromColumn(columnRepository.getReferenceById(req.getFromColumnId()))
                        .toColumn(columnRepository.getReferenceById(req.getToColumnId()))
                        .fallbackColumn(req.isRequiresApproval()
                                ? columnRepository.getReferenceById(req.getFallbackColumnId())
                                : null)
                        .requiresApproval(req.isRequiresApproval())
                        .build())
                .collect(Collectors.toList());

        List<WorkflowTransition> saved = transitionRepository.saveAll(newTransitions);
        markGatedColumns(columns, saved);

        return saved.stream()
                .map(WorkflowTransitionService::toResponse)
                .collect(Collectors.toList());
    }

    /** Gives a freshly created board the rules in {@link DefaultWorkflow}, so it is guarded from the start. */
    @Transactional
    public void applyDefaultWorkflow(Board board, List<Column> columns) {
        Map<String, Column> columnsByName = columns.stream()
                .collect(Collectors.toMap(Column::getName, Function.identity()));

        List<WorkflowTransition> rules = DefaultWorkflow.RULES.stream()
                .map(rule -> WorkflowTransition.builder()
                        .board(board)
                        .fromColumn(columnsByName.get(rule.from()))
                        .toColumn(columnsByName.get(rule.to()))
                        .fallbackColumn(rule.fallback() != null ? columnsByName.get(rule.fallback()) : null)
                        .requiresApproval(rule.requiresApproval())
                        .build())
                .collect(Collectors.toList());

        markGatedColumns(columns, transitionRepository.saveAll(rules));
    }

    /**
     * A column is gated when at least one rule into it requires approval. The rules are the only
     * source of that flag: it is recomputed here whenever they change and is never set directly.
     */
    private static void markGatedColumns(Collection<Column> columns, Collection<WorkflowTransition> rules) {
        Set<Long> gatedColumnIds = rules.stream()
                .filter(WorkflowTransition::isRequiresApproval)
                .map(rule -> rule.getToColumn().getId())
                .collect(Collectors.toSet());
        columns.forEach(column -> column.setGated(gatedColumnIds.contains(column.getId())));
    }

    private static WorkflowTransitionUpdateRequest toResponse(WorkflowTransition t) {
        return new WorkflowTransitionUpdateRequest(
                t.getFromColumn().getId(),
                t.getToColumn().getId(),
                t.getFallbackColumn() != null ? t.getFallbackColumn().getId() : null,
                t.isRequiresApproval()
        );
    }
}
