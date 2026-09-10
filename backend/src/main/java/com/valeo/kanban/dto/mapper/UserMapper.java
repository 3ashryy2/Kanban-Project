package com.valeo.kanban.dto.mapper;

import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.dto.response.AuthResponse;
import com.valeo.kanban.dto.response.TaskDto;

public class UserMapper {

    public static AuthResponse.UserDetails toUserDetails(User user) {
        if (user == null) return null;
        return AuthResponse.UserDetails.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .isAdmin(user.isAdmin())
                .build();
    }

    public static TaskDto.SimpleUserDto toSimpleUserDto(User user) {
        if (user == null) return null;
        return TaskDto.SimpleUserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .build();
    }
}
