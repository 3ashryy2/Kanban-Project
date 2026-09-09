package com.valeo.kanban.controller;

import com.valeo.kanban.dto.mapper.UserMapper;
import com.valeo.kanban.dto.response.TaskDto;
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

    @GetMapping
    @PreAuthorize("@workspaceSecurity.hasAccess(#workspaceId, principal)")
    public ResponseEntity<List<TaskDto.SimpleUserDto>> getUsersInWorkspace(@RequestParam Long workspaceId) {
        List<TaskDto.SimpleUserDto> response = userService.getUsersInWorkspace(workspaceId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me/workspaces")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<WorkspaceResponseDto>> getMyWorkspaces(@AuthenticationPrincipal CustomUserDetails currentUser) {
        List<WorkspaceResponseDto> response = workspaceService.getUserWorkspaces(currentUser);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me/workspace")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WorkspaceResponseDto> getMyWorkspace(@AuthenticationPrincipal CustomUserDetails currentUser) {
        List<WorkspaceResponseDto> workspaces = workspaceService.getUserWorkspaces(currentUser);
        if (workspaces.isEmpty()) {
            throw new jakarta.persistence.EntityNotFoundException("No workspaces found for user");
        }
        return ResponseEntity.ok(workspaces.get(0));
    }
}
