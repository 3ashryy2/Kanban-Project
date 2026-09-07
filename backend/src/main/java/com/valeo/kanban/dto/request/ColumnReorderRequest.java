package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ColumnReorderRequest {

    @NotNull(message = "Column ID is required")
    private Long columnId;

    @NotNull(message = "New position is required")
    private Double newPosition;
}
