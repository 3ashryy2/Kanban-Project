export interface SimpleUserDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin?: boolean;
}

export interface UserSummaryDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: SimpleUserDto;
}
