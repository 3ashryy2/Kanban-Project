package com.valeo.kanban.dto.response;

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
    private boolean isGated;
    private Integer wipLimit;
    @Builder.Default
    private List<TaskDto> tasks = new ArrayList<>();
}
