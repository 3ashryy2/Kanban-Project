package com.valeo.kanban.service;

import com.valeo.kanban.dto.request.LoginRequest;
import com.valeo.kanban.dto.request.RegisterRequest;
import com.valeo.kanban.dto.response.AuthResponse;
import com.valeo.kanban.exception.custom.ConflictException;
import com.valeo.kanban.model.entity.User;
import com.valeo.kanban.repository.UserRepository;
import com.valeo.kanban.security.CustomUserDetails;
import com.valeo.kanban.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        CustomUserDetails userPrincipal = (CustomUserDetails) authentication.getPrincipal();
        String jwt = tokenProvider.generateToken(authentication);

        AuthResponse.UserDetails userDetails = AuthResponse.UserDetails.builder()
                .id(userPrincipal.getId())
                .email(userPrincipal.getEmail())
                .firstName(userPrincipal.getFirstName())
                .lastName(userPrincipal.getLastName())
                .isAdmin(userPrincipal.isAdmin())
                .build();

        return AuthResponse.builder()
                .token(jwt)
                .expiresIn(tokenProvider.getExpirationInMs())
                .user(userDetails)
                .build();
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ConflictException("An account with this email already exists.");
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .build();

        User savedUser = userRepository.save(user);

        // Build authorities and userDetails directly from the saved user (Phase 5 / Issue 12)
        java.util.List<org.springframework.security.core.GrantedAuthority> authorities = java.util.Collections.singletonList(
                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_VIEWER")
        );
        CustomUserDetails userDetails = CustomUserDetails.create(savedUser, authorities);
        Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, authorities);
        String jwt = tokenProvider.generateToken(authentication);

        AuthResponse.UserDetails userDetailsDto = AuthResponse.UserDetails.builder()
                .id(savedUser.getId())
                .email(savedUser.getEmail())
                .firstName(savedUser.getFirstName())
                .lastName(savedUser.getLastName())
                .isAdmin(savedUser.isAdmin())
                .build();

        return AuthResponse.builder()
                .token(jwt)
                .expiresIn(tokenProvider.getExpirationInMs())
                .user(userDetailsDto)
                .build();
    }
}
