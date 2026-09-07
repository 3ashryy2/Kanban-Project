package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceMemberUpdateRequest {

    @NotBlank(message = "Role is required")
    private String role;
}
