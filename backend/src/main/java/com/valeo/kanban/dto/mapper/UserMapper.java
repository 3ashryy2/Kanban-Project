package com.example.kanban.dto.mapper;

import com.example.kanban.model.entity.User;
import com.example.kanban.dto.response.AuthResponse;
import com.example.kanban.dto.response.TaskDto;
import com.example.kanban.dto.response.UserSummaryDto;

public class UserMapper {

    public static AuthResponse.UserDetails toUserDetails(User user) {
        if (user == null) return null;
        return AuthResponse.UserDetails.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .admin(user.isAdmin())
                .build();
    }

    public static UserSummaryDto toSummaryDto(User user) {
        if (user == null) return null;
        return UserSummaryDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .createdAt(user.getCreatedAt())
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
