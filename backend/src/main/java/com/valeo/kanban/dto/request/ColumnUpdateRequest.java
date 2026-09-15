package com.example.kanban.dto.request;

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

    // No "isGated" here: a column is gated only through the workflow rules into it
    private Integer wipLimit;
}
