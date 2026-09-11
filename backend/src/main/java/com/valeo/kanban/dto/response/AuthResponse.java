package com.valeo.kanban.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private String token;
    @Builder.Default
    private String tokenType = "Bearer";
    private long expiresIn;
    private UserDetails user;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserDetails {
        private Long id;
        private String email;
        private String firstName;
        private String lastName;
        // Named "admin" so Lombok's isAdmin() getter and the field share one Jackson property
        @JsonProperty("isAdmin")
        private boolean admin;
    }
}
