package com.valeo.kanban.service;

import com.valeo.kanban.dto.mapper.UserMapper;
import com.valeo.kanban.dto.response.AuthResponse;
import com.valeo.kanban.dto.response.UserSummaryDto;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    static final int SEARCH_MIN_LENGTH = 2;
    static final int SEARCH_LIMIT = 20;

    private final UserRepository userRepository;

    public AuthResponse.UserDetails getCurrentUser(CustomUserDetails currentUser) {
        // The principal is reloaded from the database on every request, so it is already fresh
        return AuthResponse.UserDetails.builder()
                .id(currentUser.getId())
                .email(currentUser.getEmail())
                .firstName(currentUser.getFirstName())
                .lastName(currentUser.getLastName())
                .admin(currentUser.isAdmin())
                .build();
    }

    @Transactional(readOnly = true)
    public List<UserSummaryDto> searchUsers(String query, Long excludeWorkspaceId) {
        if (query == null || query.trim().length() < SEARCH_MIN_LENGTH) {
            throw new IllegalArgumentException("Search query must be at least " + SEARCH_MIN_LENGTH + " characters.");
        }

        String pattern = toLikePattern(query);
        Pageable limit = PageRequest.of(0, SEARCH_LIMIT);
        List<User> users = excludeWorkspaceId == null
                ? userRepository.searchByNameOrEmail(pattern, limit)
                : userRepository.searchByNameOrEmailExcludingWorkspace(pattern, excludeWorkspaceId, limit);

        return users.stream()
                .map(UserMapper::toSummaryDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserSummaryDto> getUsersWithoutWorkspace() {
        return userRepository.findAllWithoutWorkspace().stream()
                .map(UserMapper::toSummaryDto)
                .collect(Collectors.toList());
    }

    // Escapes LIKE wildcards so a query such as "%%" cannot list the whole directory
    static String toLikePattern(String query) {
        String escaped = query.trim().toLowerCase()
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
        return "%" + escaped + "%";
    }
}
