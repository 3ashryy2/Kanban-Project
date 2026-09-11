package com.valeo.kanban.controller;

import com.valeo.kanban.dto.response.UserSummaryDto;
import com.valeo.kanban.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:4200")
public class AdminUserController {

    private final UserService userService;

    // Registered users waiting for their first workspace membership
    @GetMapping("/unassigned")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public ResponseEntity<List<UserSummaryDto>> getUnassignedUsers() {
        return ResponseEntity.ok(userService.getUsersWithoutWorkspace());
    }
}
