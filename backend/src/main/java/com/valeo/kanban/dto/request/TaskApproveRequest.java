package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskApproveRequest {

    @NotNull(message = "Version is required for optimistic locking")
    private Long version;
}
