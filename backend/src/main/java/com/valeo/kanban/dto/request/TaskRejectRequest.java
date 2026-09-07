package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskRejectRequest {

    @NotNull(message = "Fallback column ID is required")
    private Long fallbackColumnId;

    @NotBlank(message = "Rejection reason is required")
    private String rejectionReason;

    @NotNull(message = "Version is required for optimistic locking")
    private Long version;
}
