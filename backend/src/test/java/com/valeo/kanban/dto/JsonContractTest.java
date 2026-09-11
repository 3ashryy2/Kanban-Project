package com.valeo.kanban.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.valeo.kanban.dto.request.ColumnCreateRequest;
import com.valeo.kanban.dto.request.ColumnUpdateRequest;
import com.valeo.kanban.dto.response.AuthResponse;
import com.valeo.kanban.dto.response.ColumnDto;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// The Angular client reads and sends "isAdmin" / "isGated"; Lombok boolean getters would otherwise map to "admin" / "gated"
class JsonContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void authUserSerializesIsAdmin() throws Exception {
        AuthResponse.UserDetails user = AuthResponse.UserDetails.builder().id(1L).email("admin@valeo.com").admin(true).build();

        String json = objectMapper.writeValueAsString(user);

        assertThat(json).contains("\"isAdmin\":true").doesNotContain("\"admin\"");
    }

    @Test
    void columnDtoSerializesIsGated() throws Exception {
        ColumnDto column = ColumnDto.builder().id(4L).name("Ready for QA").gated(true).build();

        String json = objectMapper.writeValueAsString(column);

        assertThat(json).contains("\"isGated\":true").doesNotContain("\"gated\"");
    }

    @Test
    void columnRequestsDeserializeIsGated() throws Exception {
        // A plain ObjectMapper fails on unknown properties, so an unmapped "isGated" would throw here
        ColumnCreateRequest create = objectMapper.readValue("{\"name\":\"QA\",\"position\":1.0,\"isGated\":true}", ColumnCreateRequest.class);
        ColumnUpdateRequest update = objectMapper.readValue("{\"name\":\"QA\",\"isGated\":true}", ColumnUpdateRequest.class);

        assertThat(create.isGated()).isTrue();
        assertThat(update.isGated()).isTrue();
    }
}
