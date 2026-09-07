package com.valeo.kanban.service.workflow;

import com.valeo.kanban.dto.request.WorkflowTransitionUpdateRequest;
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
import java.util.List;
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
                .map(t -> new WorkflowTransitionUpdateRequest(
                        t.getFromColumn().getId(),
                        t.getToColumn().getId(),
                        t.getFallbackColumn() != null ? t.getFallbackColumn().getId() : null,
                        t.isRequiresApproval()
                ))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<WorkflowTransitionUpdateRequest> updateTransitions(Long boardId, List<WorkflowTransitionUpdateRequest> requests) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));

        // Fetch all valid column IDs for this board
        java.util.Set<Long> validColumnIds = columnRepository.findAllByBoardIdOrderByPositionAsc(boardId)
                .stream()
                .map(Column::getId)
                .collect(Collectors.toSet());

        // Validate all transition references & check for self-transitions (Phase 5 / Issue 15)
        for (WorkflowTransitionUpdateRequest req : requests) {
            if (!validColumnIds.contains(req.getFromColumnId())) {
                throw new com.valeo.kanban.exception.custom.InvalidStateTransitionException(
                        "fromColumnId " + req.getFromColumnId() + " does not belong to board " + boardId);
            }
            if (!validColumnIds.contains(req.getToColumnId())) {
                throw new com.valeo.kanban.exception.custom.InvalidStateTransitionException(
                        "toColumnId " + req.getToColumnId() + " does not belong to board " + boardId);
            }
            if (req.getFallbackColumnId() != null && !validColumnIds.contains(req.getFallbackColumnId())) {
                throw new com.valeo.kanban.exception.custom.InvalidStateTransitionException(
                        "fallbackColumnId " + req.getFallbackColumnId() + " does not belong to board " + boardId);
            }
            if (req.getFromColumnId().equals(req.getToColumnId())) {
                throw new com.valeo.kanban.exception.custom.InvalidStateTransitionException(
                        "A column cannot transition to itself: columnId=" + req.getFromColumnId());
            }
        }

        // Delete existing transitions for this board
        List<WorkflowTransition> existing = transitionRepository.findAllByBoardId(boardId);
        transitionRepository.deleteAll(existing);
        transitionRepository.flush();

        // Map and save new transitions
        List<WorkflowTransition> newTransitions = requests.stream()
                .map(req -> {
                    Column from = columnRepository.getReferenceById(req.getFromColumnId());
                    Column to = columnRepository.getReferenceById(req.getToColumnId());
                    Column fallback = req.getFallbackColumnId() != null ?
                            columnRepository.getReferenceById(req.getFallbackColumnId()) : null;

                    return WorkflowTransition.builder()
                            .board(board)
                            .fromColumn(from)
                            .toColumn(to)
                            .fallbackColumn(fallback)
                            .requiresApproval(req.isRequiresApproval())
                            .build();
                })
                .collect(Collectors.toList());

        List<WorkflowTransition> saved = transitionRepository.saveAll(newTransitions);

        return saved.stream()
                .map(t -> new WorkflowTransitionUpdateRequest(
                        t.getFromColumn().getId(),
                        t.getToColumn().getId(),
                        t.getFallbackColumn() != null ? t.getFallbackColumn().getId() : null,
                        t.isRequiresApproval()
                ))
                .collect(Collectors.toList());
    }
}
