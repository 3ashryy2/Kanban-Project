package com.example.kanban.dto.mapper;

import com.example.kanban.model.entity.Workspace;
import com.example.kanban.dto.response.WorkspaceResponseDto;

public class WorkspaceMapper {

    public static WorkspaceResponseDto toDto(Workspace workspace, String currentUserRole, int boardCount, int memberCount) {
        if (workspace == null) return null;
        return WorkspaceResponseDto.builder()
                .id(workspace.getId())
                .name(workspace.getName())
                .slug(workspace.getSlug())
                .description(workspace.getDescription())
                .currentUserRole(currentUserRole)
                .boardCount(boardCount)
                .memberCount(memberCount)
                .build();
    }
}
