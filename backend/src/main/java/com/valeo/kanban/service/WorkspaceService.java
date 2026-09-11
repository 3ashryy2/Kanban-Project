package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.WorkspaceCreateRequest;
import com.valeo.kanban.dto.request.WorkspaceMemberCreateRequest;
import com.valeo.kanban.dto.response.WorkspaceMemberResponseDto;
import com.valeo.kanban.dto.response.WorkspaceResponseDto;
import com.valeo.kanban.dto.mapper.WorkspaceMapper;
import com.valeo.kanban.dto.mapper.WorkspaceMemberMapper;
import com.valeo.kanban.exception.custom.ConflictException;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.model.entity.Workspace;
import com.valeo.kanban.model.entity.WorkspaceMember;
import com.valeo.kanban.model.enums.WorkspaceRole;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.repository.WorkspaceMemberRepository;
import com.valeo.kanban.repository.WorkspaceRepository;
import com.valeo.kanban.repository.BoardRepository;
import com.valeo.kanban.security.CustomUserDetails;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.valeo.kanban.dto.request.WorkspaceMemberUpdateRequest;
import com.valeo.kanban.dto.response.WorkspaceCountProjection;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaceRepository;
    private final WorkspaceMemberRepository workspaceMemberRepository;
    private final UserRepository userRepository;
    private final BoardRepository boardRepository;

    @Transactional(readOnly = true)
    public List<WorkspaceResponseDto> getUserWorkspaces(CustomUserDetails currentUser) {
        // Fetch memberships with workspace in one query (Phase 4 / Issue 6)
        List<WorkspaceMember> memberships = workspaceMemberRepository.findAllByUserIdWithWorkspace(currentUser.getId());
        Map<Long, WorkspaceRole> roleByWorkspaceId = memberships.stream()
                .collect(Collectors.toMap(m -> m.getWorkspace().getId(), WorkspaceMember::getRole));

        // The global admin sees every workspace; everyone else sees only their memberships
        List<Workspace> workspaces = currentUser.isAdmin()
                ? workspaceRepository.findAll(Sort.by("name"))
                : memberships.stream()
                        .map(WorkspaceMember::getWorkspace)
                        .sorted(Comparator.comparing(Workspace::getName, String.CASE_INSENSITIVE_ORDER))
                        .collect(Collectors.toList());

        if (workspaces.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> workspaceIds = workspaces.stream()
                .map(Workspace::getId)
                .collect(Collectors.toList());

        // Two aggregate count queries (not N queries)
        Map<Long, Long> boardCounts = boardRepository.countByWorkspaceIds(workspaceIds).stream()
                .collect(Collectors.toMap(
                        WorkspaceCountProjection::getWorkspaceId,
                        WorkspaceCountProjection::getCount
                ));

        Map<Long, Long> memberCounts = workspaceMemberRepository.countByWorkspaceIds(workspaceIds).stream()
                .collect(Collectors.toMap(
                        WorkspaceCountProjection::getWorkspaceId,
                        WorkspaceCountProjection::getCount
                ));

        return workspaces.stream()
                .map(w -> {
                    long boardCount = boardCounts.getOrDefault(w.getId(), 0L);
                    long memberCount = memberCounts.getOrDefault(w.getId(), 0L);
                    return WorkspaceMapper.toDto(w, roleName(roleByWorkspaceId.get(w.getId())), (int) boardCount, (int) memberCount);
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WorkspaceResponseDto getWorkspaceById(Long workspaceId, CustomUserDetails currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        // Access is enforced by @workspaceSecurity.hasAccess; a null role means the global admin
        String currentRole = findRoleName(workspaceId, currentUser.getId());

        long boardCount = boardRepository.countByWorkspaceId(workspaceId);
        long memberCount = workspaceMemberRepository.countByWorkspaceId(workspaceId);

        return WorkspaceMapper.toDto(workspace, currentRole, (int) boardCount, (int) memberCount);
    }

    @Transactional
    public WorkspaceResponseDto createWorkspace(WorkspaceCreateRequest request, CustomUserDetails currentUser) {
        if (workspaceRepository.findBySlug(request.getSlug()).isPresent()) {
            throw new ConflictException("A workspace with the slug '" + request.getSlug() + "' already exists.");
        }

        User creator = userRepository.getReferenceById(currentUser.getId());

        Workspace workspace = Workspace.builder()
                .name(request.getName())
                .slug(request.getSlug())
                .description(request.getDescription())
                .createdBy(creator)
                .build();

        Workspace savedWorkspace = workspaceRepository.save(workspace);

        // The creating admin needs no membership; an optional initial PM gets the workspace staffed
        String creatorRole = null;
        int memberCount = 0;
        if (request.getInitialManagerId() != null) {
            User manager = userRepository.findById(request.getInitialManagerId())
                    .orElseThrow(() -> new EntityNotFoundException("User not found with ID: " + request.getInitialManagerId()));

            workspaceMemberRepository.save(WorkspaceMember.builder()
                    .workspace(savedWorkspace)
                    .user(manager)
                    .role(WorkspaceRole.ROLE_PROJECT_MANAGER)
                    .build());

            memberCount = 1;
            if (manager.getId().equals(currentUser.getId())) {
                creatorRole = WorkspaceRole.ROLE_PROJECT_MANAGER.name();
            }
        }

        return WorkspaceMapper.toDto(savedWorkspace, creatorRole, 0, memberCount);
    }

    @Transactional
    public WorkspaceResponseDto updateWorkspace(Long workspaceId, WorkspaceCreateRequest request, CustomUserDetails currentUser) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        workspace.setName(request.getName());
        workspace.setDescription(request.getDescription());
        Workspace updatedWorkspace = workspaceRepository.save(workspace);

        long boardCount = boardRepository.countByWorkspaceId(workspaceId);
        long memberCount = workspaceMemberRepository.countByWorkspaceId(workspaceId);

        return WorkspaceMapper.toDto(updatedWorkspace, findRoleName(workspaceId, currentUser.getId()), (int) boardCount, (int) memberCount);
    }

    @Transactional
    public void deleteWorkspace(Long workspaceId) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));
        workspaceRepository.delete(workspace);
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponseDto> getWorkspaceMembers(Long workspaceId) {
        return workspaceMemberRepository.findAllByWorkspaceId(workspaceId).stream()
                .map(WorkspaceMemberMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public WorkspaceMemberResponseDto addWorkspaceMember(Long workspaceId, WorkspaceMemberCreateRequest request) {
        Workspace workspace = workspaceRepository.findById(workspaceId)
                .orElseThrow(() -> new EntityNotFoundException("Workspace not found with ID: " + workspaceId));

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new EntityNotFoundException("User not found with ID: " + request.getUserId()));

        WorkspaceRole role = parseRole(request.getRole());

        if (workspaceMemberRepository.existsByWorkspaceIdAndUserId(workspaceId, user.getId())) {
            throw new ConflictException(user.getEmail() + " is already a member of this workspace.");
        }

        WorkspaceMember member = WorkspaceMember.builder()
                .workspace(workspace)
                .user(user)
                .role(role)
                .build();

        WorkspaceMember savedMember = workspaceMemberRepository.save(member);
        return WorkspaceMemberMapper.toDto(savedMember);
    }

    @Transactional
    public void removeWorkspaceMember(Long workspaceId, Long userId) {
        WorkspaceMember membership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Membership not found"));
        workspaceMemberRepository.delete(membership);
    }

    @Transactional
    public WorkspaceMemberResponseDto updateWorkspaceMemberRole(Long workspaceId, Long userId, WorkspaceMemberUpdateRequest request, CustomUserDetails currentUser) {
        WorkspaceMember targetMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Membership not found"));

        WorkspaceRole targetNewRole = parseRole(request.getRole());

        // If actor is global admin, they can change any role in any workspace
        if (currentUser.isAdmin()) {
            targetMembership.setRole(targetNewRole);
            WorkspaceMember savedMember = workspaceMemberRepository.save(targetMembership);
            return WorkspaceMemberMapper.toDto(savedMember);
        }

        WorkspaceMember actorMembership = workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, currentUser.getId())
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("You are not a member of this workspace"));

        WorkspaceRole actorRole = actorMembership.getRole();

        // Only Project Manager can modify roles locally
        if (actorRole != WorkspaceRole.ROLE_PROJECT_MANAGER) {
            throw new org.springframework.security.access.AccessDeniedException("Only Project Managers or Global Admins can modify user roles.");
        }

        targetMembership.setRole(targetNewRole);
        WorkspaceMember savedMember = workspaceMemberRepository.save(targetMembership);
        return WorkspaceMemberMapper.toDto(savedMember);
    }

    private String findRoleName(Long workspaceId, Long userId) {
        return workspaceMemberRepository.findByWorkspaceIdAndUserId(workspaceId, userId)
                .map(m -> m.getRole().name())
                .orElse(null);
    }

    private static String roleName(WorkspaceRole role) {
        return role != null ? role.name() : null;
    }

    private static WorkspaceRole parseRole(String role) {
        try {
            return WorkspaceRole.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid workspace role '" + role + "'. Allowed roles: "
                    + Arrays.toString(WorkspaceRole.values()));
        }
    }
}
