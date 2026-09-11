export interface WorkspaceResponseDto {
  id: number;
  name: string;
  slug: string;
  description?: string;
  currentUserRole?: string | null; // null for the global admin in a workspace it is not a member of
  boardCount: number;
  memberCount: number;
}

export interface WorkspaceCreateRequest {
  name: string;
  slug: string;
  description?: string;
  initialManagerId?: number | null;
}

export interface WorkspaceMemberResponseDto {
  membershipId: number;
  workspaceId: number;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  joinedAt: string;
  allBoards: boolean;      // Project Managers open every board without a membership
  boards: BoardRefDto[];   // explicit board memberships the viewer may see
}

export interface BoardRefDto {
  id: number;
  title: string;
}

export interface WorkspaceMemberCreateRequest {
  userId: number;
  role: string;
}

/** Answer to a role, board or membership change: the member now (null if removed) and the cost. */
export interface MembershipChangeResponseDto {
  member: WorkspaceMemberResponseDto | null;
  unassignedTaskCount: number;
}
