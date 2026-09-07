package com.valeo.kanban.controller;

import com.valeo.kanban.dto.mapper.UserMapper;
import com.valeo.kanban.dto.response.TaskDto;
import com.valeo.kanban.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class UserController {

    private final UserService userService;

    @GetMapping
    @PreAuthorize("@workspaceSecurity.hasAccess(#workspaceId, principal)")
    public ResponseEntity<List<TaskDto.SimpleUserDto>> getUsersInWorkspace(@RequestParam Long workspaceId) {
        List<TaskDto.SimpleUserDto> response = userService.getUsersInWorkspace(workspaceId);
        return ResponseEntity.ok(response);
    }
}
