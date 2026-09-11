package com.valeo.kanban.controller;

import com.valeo.kanban.dto.response.AuthResponse;
import com.valeo.kanban.dto.response.UserSummaryDto;
import com.valeo.kanban.service.UserService;
import com.valeo.kanban.service.WorkspaceService;
import com.valeo.kanban.dto.response.WorkspaceResponseDto;
import com.valeo.kanban.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserService userService;
    private final WorkspaceService workspaceService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AuthResponse.UserDetails> getMe(@AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(userService.getCurrentUser(currentUser));
    }

    @GetMapping("/me/workspaces")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<WorkspaceResponseDto>> getMyWorkspaces(@AuthenticationPrincipal CustomUserDetails currentUser) {
        List<WorkspaceResponseDto> response = workspaceService.getUserWorkspaces(currentUser);
        return ResponseEntity.ok(response);
    }

    // Directory lookup for adding members: any admin, or a PM of the workspace being staffed
    @GetMapping("/search")
    @PreAuthorize("hasRole('ROLE_ADMIN') or (#excludeWorkspaceId != null and @workspaceSecurity.isAdmin(#excludeWorkspaceId, principal))")
    public ResponseEntity<List<UserSummaryDto>> searchUsers(
            @RequestParam String q,
            @RequestParam(required = false) Long excludeWorkspaceId) {
        return ResponseEntity.ok(userService.searchUsers(q, excludeWorkspaceId));
    }
}
