package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceMemberCreateRequest {

    @NotNull(message = "User ID is required")
    private Long userId;

    @NotBlank(message = "Role is required")
    private String role;
}
