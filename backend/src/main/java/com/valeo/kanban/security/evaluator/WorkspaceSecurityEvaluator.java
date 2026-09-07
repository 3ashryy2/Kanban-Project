package com.valeo.kanban.security.evaluator;

import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.Arrays;

@Component("workspaceSecurity")
@RequiredArgsConstructor
public class WorkspaceSecurityEvaluator {

    private final WorkspaceMemberRepository workspaceMemberRepository;

    public boolean hasAccess(Long workspaceId, CustomUserDetails currentUser) {
        if (currentUser == null || workspaceId == null) return false;
        return workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, currentUser.getId());
    }

    public boolean isAdmin(Long workspaceId, CustomUserDetails currentUser) {
        if (currentUser == null || workspaceId == null) return false;
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                .map(m -> m.getRole() == WorkspaceRole.ROLE_ADMIN)
                .orElse(false);
    }

    public boolean hasAnyRole(Long workspaceId, CustomUserDetails currentUser, String... roles) {
        if (currentUser == null || workspaceId == null) return false;
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                .map(m -> Arrays.stream(roles)
                        .anyMatch(r -> m.getRole().name().equalsIgnoreCase(r)))
                .orElse(false);
    }
}
