package com.valeo.kanban.security;

import com.valeo.kanban.model.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.Collections;
import java.util.List;

public class CustomUserDetails implements UserDetails {

    private final Long id;
    private final String email;
    private final String password;
    private final String firstName;
    private final String lastName;
    private final Collection<? extends GrantedAuthority> authorities;

    public CustomUserDetails(Long id, String email, String password, String firstName, String lastName, Collection<? extends GrantedAuthority> authorities) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.firstName = firstName;
        this.lastName = lastName;
        this.authorities = authorities;
    }

    public static CustomUserDetails create(User user) {
        // By default, global roles can be simple. Workspace specific roles will be evaluated by custom ABAC/RBAC beans.
        List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority("ROLE_VIEWER"));
        return new CustomUserDetails(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                user.getFirstName(),
                user.getLastName(),
                authorities
        );
    }

    public static CustomUserDetails create(User user, Collection<? extends GrantedAuthority> authorities) {
        return new CustomUserDetails(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                user.getFirstName(),
                user.getLastName(),
                authorities
        );
    }

    public static CustomUserDetails createWithWorkspaceRole(User user, String workspaceRole) {
        List<GrantedAuthority> authorities = Collections.singletonList(new SimpleGrantedAuthority(workspaceRole));
        return new CustomUserDetails(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                user.getFirstName(),
                user.getLastName(),
                authorities
        );
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    // Helper method to make security SpEL evaluation easier
    public boolean hasRole(String roleName) {
        return authorities.stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase(roleName));
    }

    public boolean hasAnyRole(String... roleNames) {
        for (String role : roleNames) {
            if (hasRole(role)) {
                return true;
            }
        }
        return false;
    }
}
