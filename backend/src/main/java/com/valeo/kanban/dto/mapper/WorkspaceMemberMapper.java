package com.valeo.kanban.dto.mapper;

import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.dto.response.WorkspaceMemberResponseDto;

public class WorkspaceMemberMapper {

    public static WorkspaceMemberResponseDto toDto(WorkspaceMember member) {
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
                .build();
    }
}
