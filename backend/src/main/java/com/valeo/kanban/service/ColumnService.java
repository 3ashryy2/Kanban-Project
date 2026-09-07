package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.ColumnCreateRequest;
import com.valeo.kanban.dto.request.ColumnReorderRequest;
import com.valeo.kanban.dto.request.ColumnUpdateRequest;
import com.valeo.kanban.dto.response.ColumnDto;
import com.valeo.kanban.dto.mapper.ColumnMapper;
import com.valeo.kanban.exception.custom.ConflictException;
import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.ColumnRepository;
import com.valeo.kanban.repository.TaskRepository;
import com.valeo.kanban.repository.WorkflowTransitionRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ColumnService {

    private final ColumnRepository columnRepository;
    private final BoardRepository boardRepository;
    private final TaskRepository taskRepository;
    private final WorkflowTransitionRepository transitionRepository;

    @Transactional
    public ColumnDto createColumn(Long boardId, ColumnCreateRequest request) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));

        Column column = Column.builder()
                .board(board)
                .name(request.getName())
                .position(request.getPosition())
                .isGated(request.isGated())
                .wipLimit(request.getWipLimit())
                .build();

        Column savedColumn = columnRepository.save(column);
        return ColumnMapper.toDto(savedColumn);
    }

    @Transactional
    public ColumnDto updateColumn(Long columnId, ColumnUpdateRequest request) {
        Column column = columnRepository.findById(columnId)
                .orElseThrow(() -> new EntityNotFoundException("Column not found with ID: " + columnId));

        column.setName(request.getName());
        column.setGated(request.isGated());
        column.setWipLimit(request.getWipLimit());

        Column updatedColumn = columnRepository.save(column);
        return ColumnMapper.toDto(updatedColumn);
    }

    @Transactional
    public void reorderColumn(Long boardId, ColumnReorderRequest request) {
        Column column = columnRepository.findByIdAndBoardId(request.getColumnId(), boardId)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                        "Column does not belong to the specified board or does not exist."));

        column.setPosition(request.getNewPosition());
        columnRepository.save(column);
    }

    @Transactional
    public void deleteColumn(Long columnId) {
        Column column = columnRepository.findById(columnId)
                .orElseThrow(() -> new EntityNotFoundException("Column not found with ID: " + columnId));

        // 1. Task Existence Restriction Guard
        long taskCount = taskRepository.countByColumnId(columnId);
        if (taskCount > 0) {
            throw new ConflictException("Cannot delete column: Contains " + taskCount + " active tasks. Move tasks first.");
        }

        // 2. Workflow Transition & Fallback Integrity Guard
        boolean isReferencedInTransitions = transitionRepository
                .existsByFromColumnIdOrToColumnIdOrFallbackColumnId(columnId);

        if (isReferencedInTransitions) {
            throw new ConflictException("Cannot delete column: Active workflow transitions or rejection fallbacks reference this stage.");
        }

        columnRepository.delete(column);
    }
}
