package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskCreateRequest {

    @NotNull(message = "Board ID is required")
    private Long boardId;

    @NotNull(message = "Column ID is required")
    private Long columnId;

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    private String priority; // mapped to TaskPriority enum in service

    @NotNull(message = "Position is required")
    private Double position;

    private Long assigneeId;

    private Instant dueDate;

    private List<String> tags;
}
