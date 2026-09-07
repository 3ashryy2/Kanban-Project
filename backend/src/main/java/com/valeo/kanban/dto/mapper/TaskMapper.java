package com.valeo.kanban.dto.mapper;

import com.valeo.kanban.model.entity.Task;
import com.valeo.kanban.dto.response.TaskDto;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class TaskMapper {

    public static TaskDto toDto(Task task) {
        if (task == null) return null;

        List<String> tagsList = task.getTags() != null ? task.getTags() : Collections.emptyList();

        return TaskDto.builder()
                .id(task.getId())
                .boardId(task.getBoard().getId())
                .columnId(task.getColumn().getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .priority(task.getPriority().name())
                .status(task.getStatus().name())
                .position(task.getPosition())
                .assignee(UserMapper.toSimpleUserDto(task.getAssignee()))
                .createdBy(UserMapper.toSimpleUserDto(task.getCreatedBy()))
                .dueDate(task.getDueDate())
                .tags(tagsList)
                .rejectionReason(task.getRejectionReason())
                .version(task.getVersion())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }
}
