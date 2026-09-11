package com.valeo.kanban.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ColumnDto {
    private Long id;
    private String name;
    private double position;
    // Named "gated" so Lombok's isGated() getter and the field share one Jackson property
    @JsonProperty("isGated")
    private boolean gated;
    private Integer wipLimit;
    @Builder.Default
    private List<TaskDto> tasks = new ArrayList<>();
}
