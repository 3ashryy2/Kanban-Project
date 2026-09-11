package com.valeo.kanban.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberBoardsUpdateRequest {

    // The complete set of boards the member should belong to; an empty list removes every board
    @NotNull(message = "boardIds is required")
    private List<Long> boardIds;
}
