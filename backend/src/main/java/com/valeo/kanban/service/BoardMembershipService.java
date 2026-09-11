package com.valeo.kanban.service;

import com.valeo.kanban.dto.mapper.UserMapper;
import com.valeo.kanban.dto.mapper.WorkspaceMemberMapper;
import com.valeo.kanban.dto.response.BoardRefDto;
import com.valeo.kanban.dto.response.MembershipChangeResponseDto;
import com.valeo.kanban.dto.response.TaskDto;
import com.valeo.kanban.model.entity.BoardMember;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.BoardMemberRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.security.BoardScope;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BoardMembershipService {

    private final BoardMemberRepository boardMemberRepository;
    private final BoardRepository boardRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final BoardAccessRevocationService revocationService;

    /** Everyone who may be assigned a task on the board: its explicit members plus the workspace's PMs. */
    @Transactional(readOnly = true)
    public List<TaskDto.SimpleUserDto> getAssignableUsers(Long boardId) {
        Long workspaceId = boardRepository.findWorkspaceIdById(boardId)
                .orElseThrow(() -> new EntityNotFoundException("Board not found with ID: " + boardId));

        Map<Long, User> users = new LinkedHashMap<>();
        workspaceMemberRepository.findAllByWorkspaceIdWithUser(workspaceId).stream()
                .filter(m -> m.getRole() == WorkspaceRole.ROLE_PROJECT_MANAGER)
                .forEach(m -> users.put(m.getUser().getId(), m.getUser()));
        boardMemberRepository.findAllByBoardIdWithUser(boardId)
                .forEach(bm -> users.putIfAbsent(bm.getUser().getId(), bm.getUser()));

        return users.values().stream()
                .sorted(Comparator.comparing(User::getFirstName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(User::getLastName, String.CASE_INSENSITIVE_ORDER))
                .map(UserMapper::toSimpleUserDto)
                .collect(Collectors.toList());
    }

    /** Explicit board memberships per user in one workspace, limited to the boards the viewer may see. */
    @Transactional(readOnly = true)
    public Map<Long, List<BoardRefDto>> boardsByUser(Long workspaceId, BoardScope viewerScope) {
        return boardMemberRepository.findAllByWorkspaceIdWithBoard(workspaceId).stream()
                .filter(bm -> viewerScope.includes(bm.getBoard().getId()))
                .sorted(Comparator.comparing(bm -> bm.getBoard().getTitle(), String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.groupingBy(
                        bm -> bm.getUser().getId(),
                        Collectors.mapping(bm -> new BoardRefDto(bm.getBoard().getId(), bm.getBoard().getTitle()),
                                Collectors.toList())
                ));
    }

    /**
     * Replaces a member's explicit boards with exactly {@code boardIds}.
     * Tasks assigned to them on boards they lose are unassigned in the same transaction.
     */
    @Transactional
    public MembershipChangeResponseDto setMemberBoards(Long workspaceId, Long userId, Collection<Long> boardIds,
                                                       CustomUserDetails actor) {
        WorkspaceMember member = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Membership not found"));
        if (member.getRole() == WorkspaceRole.ROLE_PROJECT_MANAGER) {
            throw new IllegalArgumentException("Project Managers already see every board in the workspace.");
        }

        Set<Long> requested = new HashSet<>(boardIds);
        if (!new HashSet<>(boardRepository.findIdsByWorkspaceId(workspaceId)).containsAll(requested)) {
            throw new IllegalArgumentException("Every board must belong to this workspace.");
        }

        Set<Long> current = boardMemberRepository.findBoardIdsByWorkspaceIdAndUserId(workspaceId, userId);
        Set<Long> removed = difference(current, requested);
        Set<Long> added = difference(requested, current);

        int unassigned = revocationService.unassignTasksOnBoards(workspaceId, userId, removed, actor.getId());
        if (!removed.isEmpty()) {
            boardMemberRepository.deleteByUserIdAndBoardIdIn(userId, removed);
        }

        User addedBy = userRepository.getReferenceById(actor.getId());
        boardMemberRepository.saveAll(added.stream()
                .map(boardId -> BoardMember.builder()
                        .board(boardRepository.getReferenceById(boardId))
                        .workspaceId(workspaceId)
                        .user(member.getUser())
                        .addedBy(addedBy)
                        .build())
                .collect(Collectors.toList()));

        // Only Admins and PMs reach this method, and both see every board
        List<BoardRefDto> boards = boardsByUser(workspaceId, BoardScope.ALL).getOrDefault(userId, List.of());
        return MembershipChangeResponseDto.builder()
                .member(WorkspaceMemberMapper.toDto(member, boards))
                .unassignedTaskCount(unassigned)
                .build();
    }

    private static Set<Long> difference(Set<Long> from, Set<Long> minus) {
        Set<Long> result = new HashSet<>(from);
        result.removeAll(minus);
        return result;
    }
}
