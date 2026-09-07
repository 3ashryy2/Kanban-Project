package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ColumnUpdateRequest {

    @NotBlank(message = "Column name is required")
    private String name;

    private boolean isGated;

    private Integer wipLimit;
}
