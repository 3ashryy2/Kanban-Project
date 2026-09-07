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
public class BoardDetailsDto {
    private Long id;
    private Long workspaceId;
    private String title;
    private String description;
    @Builder.Default
    private List<ColumnDto> columns = new ArrayList<>();
}
