import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class GlowInput extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final VoidCallback? onSubmit;

  const GlowInput({
    super.key,
    required this.controller,
    required this.hintText,
    this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0a0a12),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD700).withOpacity(0.3),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      child: TextField(
        controller: controller,
        style: GoogleFonts.inter(
          color: Colors.white,
          fontSize: 16,
        ),
        decoration: InputDecoration(
          border: InputBorder.none,
          hintText: hintText,
          hintStyle: GoogleFonts.inter(
            color: const Color(0xFFB0B0B0),
          ),
          suffixIcon: IconButton(
            icon: const Icon(Icons.arrow_upward_rounded, color: Color(0xFFFFD700)),
            onPressed: onSubmit,
          ),
        ),
        onSubmitted: (_) => onSubmit?.call(),
      ),
    );
  }
}
