package com.valeo.kanban.controller;

import com.valeo.kanban.dto.request.BoardCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberUpdateRequest;
import com.valeo.kanban.dto.response.BoardDetailsDto;
import com.valeo.kanban.dto.response.WorkspaceMemberResponseDto;
import com.valeo.kanban.dto.response.WorkspaceResponseDto;
import com.valeo.kanban.security.CustomUserDetails;
import com.valeo.kanban.service.BoardService;
import com.valeo.kanban.service.WorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final BoardService boardService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<WorkspaceResponseDto>> getUserWorkspaces(@AuthenticationPrincipal CustomUserDetails currentUser) {
        List<WorkspaceResponseDto> response = workspaceService.getUserWorkspaces(currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public ResponseEntity<WorkspaceResponseDto> createWorkspace(
            @Valid @RequestBody WorkspaceCreateRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        WorkspaceResponseDto response = workspaceService.createWorkspace(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{workspaceId}")
    @PreAuthorize("@workspaceSecurity.hasAccess(#workspaceId, principal)")
    public ResponseEntity<WorkspaceResponseDto> getWorkspace(
            @PathVariable Long workspaceId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        WorkspaceResponseDto response = workspaceService.getWorkspaceById(workspaceId, currentUser);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{workspaceId}")
    @PreAuthorize("@workspaceSecurity.isAdmin(#workspaceId, principal)")
    public ResponseEntity<WorkspaceResponseDto> updateWorkspace(
            @PathVariable Long workspaceId,
            @Valid @RequestBody WorkspaceCreateRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        WorkspaceResponseDto response = workspaceService.updateWorkspace(workspaceId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{workspaceId}")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public ResponseEntity<Void> deleteWorkspace(@PathVariable Long workspaceId) {
        workspaceService.deleteWorkspace(workspaceId);
        return ResponseEntity.noContent().build();
    }

    // --- Membership Operations ---

    @GetMapping("/{workspaceId}/members")
    @PreAuthorize("@workspaceSecurity.hasAccess(#workspaceId, principal)")
    public ResponseEntity<List<WorkspaceMemberResponseDto>> getWorkspaceMembers(@PathVariable Long workspaceId) {
        List<WorkspaceMemberResponseDto> members = workspaceService.getWorkspaceMembers(workspaceId);
        return ResponseEntity.ok(members);
    }

    @PostMapping("/{workspaceId}/members")
    @PreAuthorize("@workspaceSecurity.isAdmin(#workspaceId, principal)")
    public ResponseEntity<WorkspaceMemberResponseDto> addWorkspaceMember(
            @PathVariable Long workspaceId,
            @Valid @RequestBody WorkspaceMemberCreateRequest request) {
        WorkspaceMemberResponseDto response = workspaceService.addWorkspaceMember(workspaceId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{workspaceId}/members/{userId}")
    @PreAuthorize("@workspaceSecurity.isAdmin(#workspaceId, principal)")
    public ResponseEntity<Void> removeWorkspaceMember(
            @PathVariable Long workspaceId,
            @PathVariable Long userId) {
        workspaceService.removeWorkspaceMember(workspaceId, userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{workspaceId}/members/{userId}")
    @PreAuthorize("@workspaceSecurity.hasAnyRole(#workspaceId, principal, 'ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<WorkspaceMemberResponseDto> updateWorkspaceMemberRole(
            @PathVariable Long workspaceId,
            @PathVariable Long userId,
            @Valid @RequestBody WorkspaceMemberUpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        WorkspaceMemberResponseDto response = workspaceService.updateWorkspaceMemberRole(workspaceId, userId, request, currentUser);
        return ResponseEntity.ok(response);
    }

    // --- Board Operations within Workspace ---

    @GetMapping("/{workspaceId}/boards")
    @PreAuthorize("@workspaceSecurity.hasAccess(#workspaceId, principal)")
    public ResponseEntity<List<BoardDetailsDto>> getWorkspaceBoards(@PathVariable Long workspaceId) {
        List<BoardDetailsDto> response = boardService.getWorkspaceBoards(workspaceId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{workspaceId}/boards")
    @PreAuthorize("@workspaceSecurity.hasAnyRole(#workspaceId, principal, 'ROLE_ADMIN', 'ROLE_PROJECT_MANAGER')")
    public ResponseEntity<BoardDetailsDto> createBoard(
            @PathVariable Long workspaceId,
            @Valid @RequestBody BoardCreateRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        BoardDetailsDto response = boardService.createBoard(workspaceId, request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
