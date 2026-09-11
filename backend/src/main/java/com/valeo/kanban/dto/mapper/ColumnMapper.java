package com.valeo.kanban.dto.mapper;

import com.valeo.kanban.model.entity.Column;
import com.valeo.kanban.dto.response.ColumnDto;
import com.valeo.kanban.dto.response.TaskDto;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class ColumnMapper {

    public static ColumnDto toDto(Column column) {
        if (column == null) return null;

        List<TaskDto> taskDtos = Collections.emptyList();
        if (column.getTasks() != null) {
            taskDtos = column.getTasks().stream()
                    .map(TaskMapper::toDto)
                    .collect(Collectors.toList());
        }

        return ColumnDto.builder()
                .id(column.getId())
                .name(column.getName())
                .position(column.getPosition())
                .gated(column.isGated())
                .wipLimit(column.getWipLimit())
                .tasks(taskDtos)
                .build();
    }

    public static ColumnDto toDtoWithTasks(Column column, List<TaskDto> taskDtos) {
        if (column == null) return null;
        return ColumnDto.builder()
                .id(column.getId())
                .name(column.getName())
                .position(column.getPosition())
                .gated(column.isGated())
                .wipLimit(column.getWipLimit())
                .tasks(taskDtos)
                .build();
    }
}
