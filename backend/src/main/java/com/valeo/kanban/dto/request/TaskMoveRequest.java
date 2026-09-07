package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskMoveRequest {

    @NotNull(message = "Target column ID is required")
    private Long targetColumnId;

    @NotNull(message = "New position is required")
    private Double newPosition;

    private boolean adminBypass;

    @NotNull(message = "Version is required for optimistic locking")
    private Long version;
}
