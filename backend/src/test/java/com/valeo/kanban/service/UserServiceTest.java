package com.valeo.kanban.service;

import com.valeo.kanban.dto.response.UserSummaryDto;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;

    @InjectMocks private UserService userService;

    @Test
    void rejectsQueriesShorterThanTheMinimum() {
        assertThatThrownBy(() -> userService.searchUsers(" a ", null))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(userRepository);
    }

    @Test
    void escapesLikeWildcardsSoTheyMatchLiterally() {
        assertThat(UserService.toLikePattern("%_!")).isEqualTo("%!%!_!!%");
        assertThat(UserService.toLikePattern("  Dev ")).isEqualTo("%dev%");
    }

    @Test
    void excludesExistingMembersWhenAWorkspaceIsGiven() {
        User dev = User.builder().id(3L).email("dev@valeo.com").firstName("Mohanad").lastName("Emad").passwordHash("hash").build();
        when(userRepository.searchByNameOrEmailExcludingWorkspace(eq("%dev%"), eq(1L), any(Pageable.class)))
                .thenReturn(List.of(dev));

        List<UserSummaryDto> result = userService.searchUsers("Dev", 1L);

        assertThat(result).extracting(UserSummaryDto::getEmail).containsExactly("dev@valeo.com");
        verify(userRepository, never()).searchByNameOrEmail(any(), any());
    }
}
