package com.valeo.kanban.dto.mapper;

import com.valeo.kanban.dto.response.BoardRefDto;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.dto.response.WorkspaceMemberResponseDto;
import java.util.List;

public class WorkspaceMemberMapper {

    public static WorkspaceMemberResponseDto toDto(WorkspaceMember member) {
        return toDto(member, List.of());
    }

    public static WorkspaceMemberResponseDto toDto(WorkspaceMember member, List<BoardRefDto> boards) {
        if (member == null) return null;
        return WorkspaceMemberResponseDto.builder()
                .membershipId(member.getId())
                .workspaceId(member.getWorkspace().getId())
                .userId(member.getUser().getId())
                .email(member.getUser().getEmail())
                .firstName(member.getUser().getFirstName())
                .lastName(member.getUser().getLastName())
                .role(member.getRole().name())
                .joinedAt(member.getJoinedAt())
                .allBoards(member.getRole() == WorkspaceRole.ROLE_PROJECT_MANAGER)
                .boards(boards)
                .build();
    }
}
