package com.valeo.kanban.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkspaceResponseDto {
    private Long id;
    private String name;
    private String slug;
    private String description;
    private String currentUserRole;
    private int boardCount;
    private int memberCount;
}
