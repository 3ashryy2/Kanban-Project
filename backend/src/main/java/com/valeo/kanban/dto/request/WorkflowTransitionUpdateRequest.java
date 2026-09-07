package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowTransitionUpdateRequest {

    @NotNull(message = "From column ID is required")
    private Long fromColumnId;

    @NotNull(message = "To column ID is required")
    private Long toColumnId;

    private Long fallbackColumnId;

    private boolean requiresApproval;
}
