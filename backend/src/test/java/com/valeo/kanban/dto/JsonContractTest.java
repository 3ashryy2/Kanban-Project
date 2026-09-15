package com.example.kanban.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.kanban.dto.response.AuthResponse;
import com.example.kanban.dto.response.ColumnDto;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// The Angular client reads "isAdmin" / "isGated"; Lombok boolean getters would otherwise map to "admin" / "gated"
class JsonContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void authUserSerializesIsAdmin() throws Exception {
        AuthResponse.UserDetails user = AuthResponse.UserDetails.builder().id(1L).email("admin@example.com").admin(true).build();

        String json = objectMapper.writeValueAsString(user);

        assertThat(json).contains("\"isAdmin\":true").doesNotContain("\"admin\"");
    }

    @Test
    void columnDtoSerializesIsGated() throws Exception {
        ColumnDto column = ColumnDto.builder().id(4L).name("Ready for QA").gated(true).build();

        String json = objectMapper.writeValueAsString(column);

        assertThat(json).contains("\"isGated\":true").doesNotContain("\"gated\"");
    }
}
