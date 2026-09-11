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
}

export interface WorkspaceMemberCreateRequest {
  userId: number;
  role: string;
}
