package com.valeo.kanban.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ColumnCreateRequest {

    @NotBlank(message = "Column name is required")
    private String name;

    @NotNull(message = "Column position is required")
    private Double position;

    @JsonProperty("isGated")
    private boolean gated;

    private Integer wipLimit;
}
