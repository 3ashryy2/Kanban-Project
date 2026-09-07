package com.valeo.kanban.dto.mapper;

import com.valeo.kanban.model.entity.Board;
import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.dto.response.BoardDetailsDto;
import com.valeo.kanban.dto.response.ColumnDto;
import com.valeo.kanban.dto.response.TaskDto;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class BoardMapper {

    public static BoardDetailsDto toAggregateDto(Board board, List<Task> tasks) {
        if (board == null) return null;

        // Group tasks by column ID
        Map<Long, List<TaskDto>> tasksByColumn = tasks.stream()
                .map(TaskMapper::toDto)
                .collect(Collectors.groupingBy(TaskDto::getColumnId));

        // Assemble ColumnDtos with in-memory grouped tasks
        List<ColumnDto> columnDtos = board.getColumns().stream()
                .map(col -> {
                    List<TaskDto> colTasks = tasksByColumn.getOrDefault(col.getId(), Collections.emptyList());
                    // Sort tasks by position just to be absolute sure of visual order
                    colTasks.sort((t1, t2) -> Double.compare(t1.getPosition(), t2.getPosition()));
                    return ColumnMapper.toDtoWithTasks(col, colTasks);
                })
                .collect(Collectors.toList());

        // Sort columns by position to guarantee visual layout sequence
        columnDtos.sort((c1, c2) -> Double.compare(c1.getPosition(), c2.getPosition()));

        return BoardDetailsDto.builder()
                .id(board.getId())
                .workspaceId(board.getWorkspace().getId())
                .title(board.getTitle())
                .description(board.getDescription())
                .columns(columnDtos)
                .build();
    }
}
