package com.valeo.kanban.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Result of changing a member's role, boards or membership: the member as it is now and what it cost. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipChangeResponseDto {
    private WorkspaceMemberResponseDto member; // null when the member was removed
    private int unassignedTaskCount;           // tasks unassigned because the user lost board access
}
