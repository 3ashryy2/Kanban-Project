package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @Size(max = 150, message = "Slug must be at most 150 characters")
    @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$",
             message = "Slug may only contain lowercase letters, numbers and single dashes")
    private String slug;

    private String description;

    // Optional: user to make the first Project Manager of a newly created workspace
    private Long initialManagerId;
}
