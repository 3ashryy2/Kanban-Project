package com.valeo.kanban.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkspaceMemberResponseDto {
    private Long membershipId;
    private Long workspaceId;
    private Long userId;
    private String email;
    private String firstName;
    private String lastName;
    private String role;
    private Instant joinedAt;
    // Project Managers open every board of the workspace without a membership row
    private boolean allBoards;
    // Explicit board memberships the viewer is allowed to see
    @Builder.Default
    private List<BoardRefDto> boards = new ArrayList<>();
}
