package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BoardCreateRequest {

    @NotBlank(message = "Board title is required")
    private String title;

    private String description;
}
