package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceCreateRequest {

    @NotBlank(message = "Workspace name is required")
    private String name;

    @NotBlank(message = "Workspace slug is required")
    private String slug;

    private String description;
}
