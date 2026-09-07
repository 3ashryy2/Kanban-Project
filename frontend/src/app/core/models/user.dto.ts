export interface SimpleUserDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
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
