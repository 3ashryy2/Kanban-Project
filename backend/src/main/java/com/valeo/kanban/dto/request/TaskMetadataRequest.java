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
public class TaskMetadataRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    private String priority;

    private Instant dueDate;

    private List<String> tags;

    @NotNull(message = "Version is required for optimistic locking")
    private Long version;
}
